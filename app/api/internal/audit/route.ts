import { NextRequest, NextResponse } from "next/server";
import { auditLog } from "@/lib/audit-log";
import { createLogger } from "@/lib/logger";

const log = createLogger("internal/audit");

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const actor = searchParams.get("actor") ?? undefined;
  const riskLevel = searchParams.get("riskLevel") ?? undefined;
  const sinceRaw = searchParams.get("since");
  const since = sinceRaw !== null ? Number(sinceRaw) : undefined;

  const entries = auditLog.query({ actor, riskLevel, since });
  log.info("query", { actor, riskLevel, since, count: entries.length });
  return NextResponse.json(entries);
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const entry = auditLog.append({
    ts: typeof body.ts === "number" ? body.ts : Date.now(),
    actor: String(body.actor ?? "unknown"),
    action: String(body.action ?? ""),
    target: body.target !== undefined ? String(body.target) : undefined,
    detail: body.detail !== undefined ? String(body.detail) : undefined,
    riskLevel: (body.riskLevel as "low" | "medium" | "high") ?? undefined,
  });

  log.info("appended", entry.id, entry.action);
  return NextResponse.json(entry, { status: 201 });
}
