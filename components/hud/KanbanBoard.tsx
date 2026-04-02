"use client";

import type { TaskItem, TaskStatus } from "@/types/game";
import { formatRelativeTime } from "@/lib/constants";

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "submitted", label: "Submitted" },
  { status: "queued", label: "Queued" },
  { status: "returning", label: "Returning" },
  { status: "running", label: "Running" },
  { status: "completed", label: "Completed" },
  { status: "failed", label: "Failed" },
];

const COLLAPSE_STATUSES = new Set<TaskStatus>(["completed", "failed"]);
const COLLAPSE_LIMIT = 5;

const STATUS_COLORS: Partial<Record<TaskStatus, string>> = {
  submitted: "var(--pixel-accent, #4af)",
  queued: "var(--pixel-muted, #888)",
  returning: "#a78bfa",
  running: "#4ade80",
  completed: "#6ee7b7",
  failed: "#f87171",
};

function shortId(taskId: string) {
  return taskId.length > 8 ? taskId.slice(-8) : taskId;
}

function snippet(text: string, max = 40) {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

function KanbanCard({
  task,
  onSelectTask,
}: {
  task: TaskItem;
  onSelectTask?: (taskId: string) => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelectTask?.(task.taskId)}
      onKeyDown={(e) => e.key === "Enter" && onSelectTask?.(task.taskId)}
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 2,
        padding: "6px 8px",
        marginBottom: 4,
        cursor: onSelectTask ? "pointer" : "default",
        fontFamily: "var(--font-pixel, monospace)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 3,
        }}
      >
        <span
          style={{
            fontSize: 8,
            color: "var(--pixel-accent, #4af)",
            fontFamily: "monospace",
            letterSpacing: 0.5,
          }}
        >
          #{shortId(task.taskId)}
        </span>
        <span style={{ fontSize: 7, color: "var(--pixel-muted, #888)" }}>
          {formatRelativeTime(task.createdAt)}
        </span>
      </div>
      <div
        style={{
          fontSize: 8,
          color: "var(--pixel-text, #ccc)",
          marginBottom: 4,
          lineHeight: 1.4,
          wordBreak: "break-word",
        }}
      >
        {snippet(task.message)}
      </div>
      {task.actorName && (
        <span
          style={{
            display: "inline-block",
            fontSize: 7,
            color: "#0a0",
            background: "rgba(0,200,80,0.12)",
            border: "1px solid rgba(0,200,80,0.25)",
            borderRadius: 2,
            padding: "1px 4px",
            letterSpacing: 0.3,
          }}
        >
          {task.actorName}
        </span>
      )}
      {!task.actorName && <span style={{ fontSize: 7, color: "var(--pixel-muted, #888)" }}>—</span>}
    </div>
  );
}

function KanbanColumn({
  status,
  label,
  tasks,
  onSelectTask,
}: {
  status: TaskStatus;
  label: string;
  tasks: TaskItem[];
  onSelectTask?: (taskId: string) => void;
}) {
  const collapse = COLLAPSE_STATUSES.has(status);
  const visible = collapse ? tasks.slice(-COLLAPSE_LIMIT) : tasks;
  const hidden = collapse ? Math.max(0, tasks.length - COLLAPSE_LIMIT) : 0;
  const accentColor = STATUS_COLORS[status] ?? "var(--pixel-muted, #888)";

  return (
    <div
      style={{
        minWidth: 160,
        maxWidth: 200,
        flex: "0 0 160px",
        display: "flex",
        flexDirection: "column",
        background: "rgba(0,0,0,0.25)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 3,
        padding: "6px 6px 4px",
      }}
    >
      {/* Column header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 6,
          paddingBottom: 4,
          borderBottom: `1px solid ${accentColor}44`,
        }}
      >
        <span
          style={{
            fontSize: 7,
            textTransform: "uppercase",
            letterSpacing: 1,
            color: accentColor,
            fontFamily: "var(--font-pixel, monospace)",
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontSize: 7,
            background: `${accentColor}22`,
            border: `1px solid ${accentColor}55`,
            borderRadius: 2,
            padding: "1px 5px",
            color: accentColor,
            fontFamily: "monospace",
          }}
        >
          {tasks.length}
        </span>
      </div>

      {/* Cards */}
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        {hidden > 0 && (
          <div
            style={{
              fontSize: 7,
              color: "var(--pixel-muted, #888)",
              textAlign: "center",
              marginBottom: 4,
              fontFamily: "monospace",
            }}
          >
            …{hidden} more
          </div>
        )}
        {visible.length === 0 ? (
          <div
            style={{
              fontSize: 7,
              color: "var(--pixel-muted, #555)",
              textAlign: "center",
              padding: "8px 0",
              fontFamily: "monospace",
            }}
          >
            empty
          </div>
        ) : (
          visible.map((task) => (
            <KanbanCard key={task.taskId} task={task} onSelectTask={onSelectTask} />
          ))
        )}
      </div>
    </div>
  );
}

export default function KanbanBoard({
  tasks,
  onSelectTask,
}: {
  tasks: TaskItem[];
  onSelectTask?: (taskId: string) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        gap: 8,
        overflowX: "auto",
        padding: "8px 0",
        fontFamily: "var(--font-pixel, monospace)",
      }}
    >
      {COLUMNS.map(({ status, label }) => (
        <KanbanColumn
          key={status}
          status={status}
          label={label}
          tasks={tasks.filter((t) => t.status === status)}
          onSelectTask={onSelectTask}
        />
      ))}
    </div>
  );
}
