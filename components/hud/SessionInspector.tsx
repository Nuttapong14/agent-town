"use client";

import { useEffect, useRef, useState } from "react";
import { gameEvents } from "@/lib/events";

type LogLevel = "info" | "warn" | "error";

interface LogLine {
  id: number;
  level: LogLevel;
  msg: string;
  ts: number;
}

const LEVEL_COLOR: Record<LogLevel, string> = {
  info: "#4ade80",
  warn: "#facc15",
  error: "#f87171",
};

const MAX_LOG_LINES = 50;
let lineSeq = 0;

function formatTs(ts: number) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

function formatDuration(fromIso?: string) {
  if (!fromIso) return "--";
  const ms = Date.now() - new Date(fromIso).getTime();
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ${secs % 60}s`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m`;
}

export default function SessionInspector({
  agentId,
  sessionId,
  onClose,
  isOpen,
}: {
  agentId?: string;
  sessionId?: string;
  onClose: () => void;
  isOpen: boolean;
}) {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [openedAt] = useState<string>(() => new Date().toISOString());
  const [duration, setDuration] = useState("0s");
  const [closing, setClosing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLogs([]);
    const unsub = gameEvents.on("agent:log", (id, level, msg, ts) => {
      if (agentId && id !== agentId) return;
      setLogs((prev) => {
        const next = [...prev, { id: ++lineSeq, level, msg, ts }];
        return next.length > MAX_LOG_LINES ? next.slice(next.length - MAX_LOG_LINES) : next;
      });
    });
    return unsub;
  }, [agentId, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => {
      setDuration(formatDuration(openedAt));
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen, openedAt]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const handleForceClose = async () => {
    if (!agentId) return;
    setClosing(true);
    try {
      await fetch(`/api/agents/${agentId}`, { method: "DELETE" });
    } catch {
      // best-effort
    } finally {
      setClosing(false);
      onClose();
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        height: "100vh",
        width: 320,
        background: "rgba(10,10,14,0.97)",
        borderLeft: "1px solid var(--pixel-border)",
        display: "flex",
        flexDirection: "column",
        fontFamily: "var(--font-mono, monospace)",
        fontSize: 10,
        zIndex: 1000,
        transform: isOpen ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.2s ease",
        pointerEvents: isOpen ? "auto" : "none",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "10px 12px",
          borderBottom: "1px solid var(--pixel-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 1,
              color: "var(--pixel-accent)",
            }}
          >
            Session Inspector
          </div>
          {agentId && (
            <div style={{ fontSize: 8, color: "var(--pixel-muted)", marginTop: 2 }}>
              Agent: {agentId}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: "none",
            border: "1px solid var(--pixel-border)",
            color: "var(--pixel-muted)",
            cursor: "pointer",
            borderRadius: 3,
            padding: "3px 7px",
            fontSize: 9,
            fontFamily: "inherit",
          }}
          aria-label="Close inspector"
        >
          ✕
        </button>
      </div>

      {/* Metadata */}
      <div
        style={{
          padding: "10px 12px",
          borderBottom: "1px solid var(--pixel-border)",
          flexShrink: 0,
        }}
      >
        <MetaRow label="Session ID" value={sessionId ?? "--"} />
        <MetaRow label="Open Duration" value={duration} />
        <MetaRow label="Log Lines" value={String(logs.length)} />
      </div>

      {/* Log lines */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "6px 0",
        }}
      >
        {logs.length === 0 ? (
          <div
            style={{
              padding: "12px",
              color: "var(--pixel-muted)",
              fontSize: 9,
              textAlign: "center",
            }}
          >
            No log entries yet.
          </div>
        ) : (
          logs.map((line) => (
            <div
              key={line.id}
              style={{
                display: "flex",
                gap: 5,
                padding: "1px 10px",
                fontSize: 8,
                lineHeight: "14px",
                borderBottom: "1px solid rgba(255,255,255,0.03)",
              }}
            >
              <span style={{ color: "var(--pixel-muted)", whiteSpace: "nowrap", flexShrink: 0 }}>
                {formatTs(line.ts)}
              </span>
              <span
                style={{
                  color: LEVEL_COLOR[line.level],
                  textTransform: "uppercase",
                  fontSize: 7,
                  fontWeight: 700,
                  flexShrink: 0,
                  alignSelf: "center",
                }}
              >
                {line.level}
              </span>
              <span
                style={{
                  color: "var(--pixel-text)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {line.msg}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Footer actions */}
      <div
        style={{
          padding: "10px 12px",
          borderTop: "1px solid var(--pixel-border)",
          flexShrink: 0,
          display: "flex",
          gap: 8,
        }}
      >
        <button
          type="button"
          onClick={handleForceClose}
          disabled={closing || !agentId}
          style={{
            flex: 1,
            padding: "6px 10px",
            fontSize: 9,
            fontFamily: "inherit",
            textTransform: "uppercase",
            letterSpacing: 0.5,
            fontWeight: 700,
            border: "1px solid #f8717166",
            borderRadius: 3,
            background: closing ? "rgba(239,68,68,0.1)" : "rgba(239,68,68,0.15)",
            color: closing ? "var(--pixel-muted)" : "#f87171",
            cursor: agentId && !closing ? "pointer" : "not-allowed",
            transition: "background 0.1s",
          }}
        >
          {closing ? "Closing..." : "Force Close Session"}
        </button>
      </div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 4,
        fontSize: 9,
      }}
    >
      <span
        style={{
          color: "var(--pixel-muted)",
          textTransform: "uppercase",
          letterSpacing: 0.5,
          fontSize: 7,
        }}
      >
        {label}
      </span>
      <span
        style={{
          color: "var(--pixel-text)",
          fontFamily: "var(--font-mono, monospace)",
          maxWidth: 180,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}
