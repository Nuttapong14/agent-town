/**
 * GET  /api/agents  – return full agent roster
 * POST /api/agents  – register a new agent
 */

import { NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";
import { getAllAgents, registerAgent } from "@/lib/fleetManager";
import { Agent } from "@/types/game";

const log = createLogger("agents/fleet");

export async function GET() {
  const roster = getAllAgents();
  log.info(`roster requested, ${roster.length} agents`);
  return NextResponse.json(roster);
}

export async function POST(req: NextRequest) {
  let body: Agent;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  if (!body.id || !body.name) {
    return NextResponse.json({ error: "id and name are required" }, { status: 400 });
  }

  registerAgent(body);
  log.info(`registered agent ${body.id}`);
  return NextResponse.json({ agent: body }, { status: 201 });
}
