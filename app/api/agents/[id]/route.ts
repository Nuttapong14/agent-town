/**
 * PATCH  /api/agents/[id]  – partial update (status, position, emote, …)
 * DELETE /api/agents/[id]  – retire / remove agent
 */

import { NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";
import { updateAgent, removeAgent } from "@/lib/fleetManager";
import { Agent } from "@/types/game";

const log = createLogger("agents/fleet");

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let patch: Partial<Agent>;
  try {
    patch = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const updated = updateAgent(id, patch);
  if (!updated) {
    return NextResponse.json({ error: "agent not found" }, { status: 404 });
  }

  log.info(`updated agent ${id}`);
  return NextResponse.json({ agent: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const removed = removeAgent(id);
  if (!removed) {
    return NextResponse.json({ error: "agent not found" }, { status: 404 });
  }

  log.info(`deleted agent ${id}`);
  return new NextResponse(null, { status: 204 });
}
