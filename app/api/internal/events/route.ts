import { NextRequest, NextResponse } from "next/server";
import { gameEvents } from "@/lib/events";
import { createLogger } from "@/lib/logger";

const log = createLogger("internal/events");

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const { type } = body;
  if (typeof type !== "string" || !type) {
    return NextResponse.json({ error: "missing type field" }, { status: 400 });
  }

  log.info("received event", type, body);

  const ts = typeof body.ts === "number" ? body.ts : Date.now();

  switch (type) {
    case "agent:log":
      gameEvents.emit(
        "agent:log",
        String(body.agentId ?? ""),
        body.level as "info" | "warn" | "error",
        String(body.msg ?? ""),
        ts,
      );
      break;
    case "agent:health":
      gameEvents.emit(
        "agent:health",
        String(body.agentId ?? ""),
        body.status as "alive" | "stalled" | "blocked",
        ts,
      );
      break;
    case "session:open":
      gameEvents.emit("session:open", String(body.agentId ?? ""), String(body.sessionId ?? ""), ts);
      break;
    case "session:close":
      gameEvents.emit(
        "session:close",
        String(body.agentId ?? ""),
        String(body.sessionId ?? ""),
        ts,
      );
      break;
    case "work:queued":
      gameEvents.emit("work:queued", String(body.taskId ?? ""), String(body.agentId ?? ""), ts);
      break;
    case "work:active":
      gameEvents.emit("work:active", String(body.taskId ?? ""), String(body.agentId ?? ""), ts);
      break;
    case "usage:tokens":
      gameEvents.emit(
        "usage:tokens",
        String(body.agentId ?? ""),
        String(body.model ?? ""),
        Number(body.promptTokens ?? 0),
        Number(body.completionTokens ?? 0),
        Number(body.costUsd ?? 0),
        ts,
      );
      break;
    case "usage:context":
      gameEvents.emit(
        "usage:context",
        String(body.agentId ?? ""),
        Number(body.contextUsed ?? 0),
        Number(body.contextMax ?? 0),
        Number(body.pressurePct ?? 0),
        ts,
      );
      break;
    case "usage:budget":
      gameEvents.emit(
        "usage:budget",
        String(body.agentId ?? ""),
        Number(body.spentUsd ?? 0),
        Number(body.budgetUsd ?? 0),
        body.riskLevel as "low" | "medium" | "high",
        ts,
      );
      break;
    default:
      log.warn("unknown event type:", type);
  }

  return NextResponse.json({ ok: true });
}
